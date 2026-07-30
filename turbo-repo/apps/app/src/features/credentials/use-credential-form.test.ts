import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { z } from "zod";
import type {
  CredentialListItem,
  CredentialTestResult,
} from "./credential.types";
import { useCredentialForm } from "./use-credential-form";

/**
 * A stand-in credential type. The hook is exercised through one of these rather
 * than through Entra/OAuth2/Auth0 so the tests pin the shared lifecycle itself,
 * not any one provider's field list.
 */
interface DemoFormData {
  name: string;
  environment: string;
  secret: string;
}

const Schema = z.object({
  name: z.string().min(1, "nameRequired"),
  environment: z.string().min(1, "environmentRequired"),
  secret: z.string().min(1, "secretRequired"),
});

/** Mirrors the real edit schemas: the secret may be left blank to keep it. */
const EditSchema = Schema.extend({ secret: z.string().optional() });

const DEFAULTS: DemoFormData = {
  name: "",
  environment: "DEVELOPMENT",
  secret: "",
};

const STORED: CredentialListItem = {
  id: "cred-1",
  name: "Alerce PostgREST",
  typeId: "OAUTH2_CLIENT_CREDENTIALS",
  environment: "PRODUCTION",
  summary: "BJB1…h2uT",
  usedBy: [],
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
  updatedBy: "someone",
  config: { clientId: "BJB1EDngavgv6jRxjfZWviXLshXxh2uT" },
};

function toFormValues(editing: CredentialListItem): DemoFormData {
  return {
    name: editing.name,
    environment: editing.environment,
    // Never projected back: the API does not return it, and a populated-looking
    // secret field would misrepresent what is about to be saved.
    secret: "",
  };
}

const ok: CredentialTestResult = {
  success: true,
  message: "",
  expiresInSeconds: 86400,
};

function setup(overrides: {
  show?: boolean;
  editing?: CredentialListItem | null;
  onTest?: (data: DemoFormData) => Promise<CredentialTestResult>;
}) {
  const onTest = overrides.onTest ?? (() => Promise.resolve(ok));
  return renderHook(
    (props: { show: boolean; editing: CredentialListItem | null }) =>
      useCredentialForm<DemoFormData>({
        show: props.show,
        editing: props.editing,
        onClose: () => {},
        onSubmit: () => {},
        onTest,
        dict: {},
        defaults: DEFAULTS,
        schema: Schema,
        editSchema: EditSchema,
        toFormValues,
      }),
    {
      initialProps: {
        show: overrides.show ?? true,
        editing: overrides.editing ?? null,
      },
    }
  );
}

describe("useCredentialForm", () => {
  it("opens a create form on the supplied defaults", async () => {
    const { result } = setup({ editing: null });

    await waitFor(() =>
      expect(result.current.form.getValues()).toEqual(DEFAULTS)
    );
    expect(result.current.isEdit).toBe(false);
  });

  it("projects the stored record when editing", async () => {
    const { result } = setup({ editing: STORED });

    await waitFor(() =>
      expect(result.current.form.getValues()).toEqual({
        name: "Alerce PostgREST",
        environment: "PRODUCTION",
        secret: "",
      })
    );
    expect(result.current.isEdit).toBe(true);
  });

  it("re-initializes on open so a reopened form cannot show the last one's input", async () => {
    const { result, rerender } = setup({ show: true, editing: null });

    await waitFor(() => expect(result.current.form.getValues("name")).toBe(""));
    act(() => {
      result.current.form.setValue("name", "half-typed");
      result.current.form.setValue("secret", "s3cret-in-flight");
    });
    expect(result.current.form.getValues("secret")).toBe("s3cret-in-flight");

    // Close, then reopen against a different record.
    rerender({ show: false, editing: null });
    rerender({ show: true, editing: STORED });

    await waitFor(() =>
      expect(result.current.form.getValues()).toEqual({
        name: "Alerce PostgREST",
        environment: "PRODUCTION",
        secret: "",
      })
    );
  });

  it("leaves the form alone while it is closed", async () => {
    const { result, rerender } = setup({ show: false, editing: null });

    act(() => result.current.form.setValue("name", "untouched"));
    rerender({ show: false, editing: STORED });

    await waitFor(() =>
      expect(result.current.form.getValues("name")).toBe("untouched")
    );
  });

  it("tracks a test run and clears the outcome when reopened", async () => {
    const { result, rerender } = setup({ editing: null });

    expect(result.current.testResult).toBeNull();
    await act(async () => {
      await result.current.runTest({ ...DEFAULTS, secret: "x" });
    });
    expect(result.current.testResult).toEqual(ok);
    expect(result.current.testing).toBe(false);

    // A stale green tick against a form that has since changed would be a lie.
    rerender({ show: false, editing: null });
    rerender({ show: true, editing: null });
    await waitFor(() => expect(result.current.testResult).toBeNull());
  });

  it("clears the testing flag even when the grant rejects", async () => {
    const onTest = vi.fn().mockRejectedValue(new Error("network down"));
    const { result } = setup({ editing: null, onTest });

    await expect(
      act(async () => {
        await result.current.runTest({ ...DEFAULTS, secret: "x" });
      })
    ).rejects.toThrow("network down");
    expect(result.current.testing).toBe(false);
  });

  it("requires the secret when creating", async () => {
    const onValid = vi.fn();
    const { result } = setup({ editing: null });

    await waitFor(() => expect(result.current.form.getValues("name")).toBe(""));
    act(() => {
      result.current.form.setValue("name", "New credential");
    });
    await act(async () => {
      await result.current.form.handleSubmit(onValid)();
    });

    expect(onValid).not.toHaveBeenCalled();
    // Via getFieldState rather than formState.errors: formState is a proxy that
    // only subscribes to what a *render* reads, and this harness renders no
    // fields, so errors would read as empty however validation actually went.
    expect(result.current.form.getFieldState("secret").error?.message).toBe(
      "secretRequired"
    );
  });

  it("accepts a blank secret when editing, so an untouched form keeps the stored one", async () => {
    const onValid = vi.fn();
    const { result } = setup({ editing: STORED });

    await waitFor(() =>
      expect(result.current.form.getValues("name")).toBe("Alerce PostgREST")
    );
    await act(async () => {
      await result.current.form.handleSubmit(onValid)();
    });

    expect(onValid).toHaveBeenCalledTimes(1);
    expect(onValid.mock.calls[0][0]).toMatchObject({ secret: "" });
  });
});
