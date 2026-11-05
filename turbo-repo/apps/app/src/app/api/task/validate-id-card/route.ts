import {
  login,
  createContent,
  signIdCard,
} from "@/features/common/providers/5cap-api/5cap-api.provider";
import {
  ContentRequest,
  SignIdCardRequest,
} from "@/features/common/providers/5cap-api/5cap-api.provider.types";
import { describeError } from "@/features/common/providers/fetcher-error";
import { maskRut } from "@/features/totem/diagnostics/totem-diagnostics";
import { createLogger } from "@/lib/logger";
import { generateRequestId } from "@/features/common/utils/access-log";

import { NextRequest, NextResponse } from "next/server";
import { readPDFAsBase64 } from "@/utils/pdf-utils";

export type ValidateIdCardStep =
  | "PARSE"
  | "CAP_LOGIN"
  | "CAP_CONTENT"
  | "CAP_SIGN";

export type ValidateIdCardResponse =
  | { success: true; requestId: string; response: unknown }
  | {
      success: false;
      requestId: string;
      step: ValidateIdCardStep;
      status: number;
      code: string;
      message: string;
    };

const totemLogger = createLogger("totem");

class StepError extends Error {
  step: ValidateIdCardStep;
  status: number;
  code: string;
  constructor(step: ValidateIdCardStep, status: number, message: string, code = "CAP_ERROR") {
    super(message);
    this.step = step;
    this.status = status;
    this.code = code;
  }
}

function failure(
  requestId: string,
  step: ValidateIdCardStep,
  status: number,
  code: string,
  message: string
) {
  return NextResponse.json<ValidateIdCardResponse>({
    success: false,
    requestId,
    step,
    status,
    code,
    message,
  });
}

export async function POST(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ?? generateRequestId();
  const startedAt = Date.now();
  let step: ValidateIdCardStep = "PARSE";
  let stepStartedAt = startedAt;
  let rutForLog = "";

  const enter = (next: ValidateIdCardStep) => {
    step = next;
    stepStartedAt = Date.now();
  };
  const leave = (status: number) => {
    totemLogger.info(
      { requestId, step, status, rut: rutForLog, durationMs: Date.now() - stepStartedAt },
      `validate-id-card ${step} done`
    );
  };

  try {
    const json = (await request.json()) as {
      user_rut?: string;
      nro_serie?: string;
    };
    if (!json.user_rut || !json.nro_serie) {
      return failure(requestId, "PARSE", 400, "MISSING_FIELDS", "user_rut and nro_serie are required");
    }
    rutForLog = maskRut(json.user_rut);
    totemLogger.info(
      { requestId, rut: rutForLog, serialLength: json.nro_serie.length },
      "validate-id-card start"
    );

    enter("CAP_LOGIN");
    const loginResult = await login();
    if (loginResult.status !== 200 || !loginResult.session_id) {
      throw new StepError(step, loginResult.status, loginResult.message, "CAP_LOGIN_REJECTED");
    }
    leave(loginResult.status);
    const sessionId = loginResult.session_id;
    const institutionId = process.env.DEC5_INSTITUTION!;
    const targetContentType = process.env.DEC5_TARGET_CONTENT_TYPE!;

    enter("CAP_CONTENT");
    const fileContent = await readPDFAsBase64("servicios-mineros.pdf");
    const createContentRequest: ContentRequest = {
      type_code: targetContentType,
      institution: institutionId,
      name: "Servicios Mineros",
      session_id: sessionId,
      signers_roles: [json.user_rut, "Admin"],
      signers_institutions: [json.user_rut, institutionId],
      signers_emails: ["michel@microboxlabs.com", "any"],
      signers_ruts: [json.user_rut, "any"],
      signers_type: [0, 5],
      signers_order: [1, 1],
      signers_notify: [2, 0],
      signers_audit: [""],
      file: fileContent,
      file_mime: "application/pdf",
      return_file: 1,
    };
    const contentResult = await createContent(createContentRequest);
    if (contentResult.status !== 200 || !contentResult.result?.code) {
      throw new StepError(step, contentResult.status, contentResult.message, "CAP_CONTENT_REJECTED");
    }
    leave(contentResult.status);

    enter("CAP_SIGN");
    const signIdCardRequest: SignIdCardRequest = {
      user_rut: json.user_rut,
      nro_serie: json.nro_serie,
      user_role: json.user_rut,
      user_institution: institutionId,
      code: contentResult.result.code,
      session_id: sessionId,
    };
    const signResult = await signIdCard(signIdCardRequest);
    if (signResult.status !== 200) {
      throw new StepError(step, signResult.status, signResult.message, "CAP_SIGN_REJECTED");
    }
    leave(signResult.status);

    totemLogger.info(
      { requestId, rut: rutForLog, durationMs: Date.now() - startedAt },
      "validate-id-card ok"
    );
    return NextResponse.json<ValidateIdCardResponse>({
      success: true,
      requestId,
      response: contentResult,
    });
  } catch (error) {
    const described =
      error instanceof StepError
        ? { status: error.status, code: error.code, message: error.message }
        : describeError(error);
    totemLogger.error(
      {
        requestId,
        step,
        rut: rutForLog,
        durationMs: Date.now() - startedAt,
        stepDurationMs: Date.now() - stepStartedAt,
        ...described,
        err: error instanceof StepError ? undefined : (error as Error),
      },
      `validate-id-card failed at ${step}`
    );
    return failure(requestId, step, described.status, described.code, described.message);
  }
}
