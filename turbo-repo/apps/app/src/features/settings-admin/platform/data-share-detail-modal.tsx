"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "flowbite-react";
import { HiOutlineArrowRight } from "react-icons/hi";
import { toast } from "sonner";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  coveredAssets,
  formatCount,
  formatDate,
  ORIGIN_COLORS,
  scopeLabel,
  STATUS_COLORS,
} from "./data-sharing";
import type {
  DataShare,
  DataShareFilter,
  DataShareOrg,
} from "./platform.types";
import { useShareableAssets } from "./use-platform-data-shares";

interface DataShareDetailModalProps {
  readonly dict: I18nRecord;
  readonly lang: string;
  readonly share: DataShare | null;
  readonly orgs: ReadonlyMap<string, DataShareOrg>;
  readonly onClose: () => void;
  readonly onRevoke: (id: string) => Promise<void>;
}

const SHOWN_ASSETS = 60;

function criteria(filter: DataShareFilter, dict: I18nRecord) {
  const any = tr("detail.any", dict);
  const owners = filter.owners
    .map((o) => o || tr("picker.noOwner", dict))
    .join(", ");
  return tr("detail.criteriaValue", dict, {
    owners: owners || any,
    kinds:
      filter.kinds.map((k) => k || tr("picker.noKind", dict)).join(", ") || any,
  });
}

export default function DataShareDetailModal({
  dict,
  lang,
  share,
  orgs,
  onClose,
  onRevoke,
}: Readonly<DataShareDetailModalProps>) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const { assets: sourceAssets } = useShareableAssets(
    share && share.scope !== "ASSETS" ? share.sourceOrg : ""
  );

  if (!share) {
    return null;
  }

  const status = share.status;
  const source = orgs.get(share.sourceOrg);
  const target = orgs.get(share.targetOrg);
  const assets =
    share.scope === "ASSETS"
      ? share.assetIds
      : coveredAssets(share, sourceAssets).map((a) => a.id);
  const revocable = status === "ACTIVE" || status === "SCHEDULED";

  const revoke = async () => {
    setBusy(true);
    try {
      await onRevoke(share.id);
      toast.success(tr("detail.revoked", dict));
      setConfirming(false);
    } catch {
      toast.error(tr("detail.revokeError", dict));
    } finally {
      setBusy(false);
    }
  };

  const facts: [string, string][] = [
    [tr("table.scope", dict), scopeLabel(share, dict, lang)],
    [
      tr("table.validity", dict),
      `${formatDate(share.validFrom, lang)} – ${
        formatDate(share.validTo, lang) ?? tr("noEnd", dict)
      }`,
    ],
    [
      tr("detail.created", dict),
      `${share.createdBy} · ${formatDate(share.createdAt, lang)}`,
    ],
  ];
  if (share.revokedAt) {
    facts.push([
      tr("detail.revokedBy", dict),
      `${share.revokedBy ?? "—"} · ${formatDate(share.revokedAt, lang)}`,
    ]);
  }
  if (share.filter) {
    facts.push([tr("detail.criteria", dict), criteria(share.filter, dict)]);
  }
  if (share.note) {
    facts.push([tr("form.note", dict), share.note]);
  }

  return (
    <>
      <Modal show={!confirming} onClose={onClose} size="2xl" dismissible>
        <ModalHeader>
          <span className="flex flex-wrap items-center gap-2">
            {source?.name ?? share.sourceOrg}
            <HiOutlineArrowRight className="h-4 w-4 text-gray-400" />
            {target?.name ?? share.targetOrg}
          </span>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge color={STATUS_COLORS[status]}>
                {trDynamic(`status.${status}`, dict)}
              </Badge>
              <Badge color={ORIGIN_COLORS[share.origin]}>
                {trDynamic(`origin.${share.origin}`, dict)}
              </Badge>
            </div>
            {share.origin !== "MANUAL" && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {trDynamic(`detail.originHint.${share.origin}`, dict)}
              </p>
            )}
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
              {facts.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                  <dd className="text-gray-900 dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
                {tr("detail.assets", dict)}
              </h3>
              {share.scope !== "ASSETS" && (
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  {trDynamic(`scope.hint.${share.scope}`, dict)}
                </p>
              )}
              <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
                {assets.slice(0, SHOWN_ASSETS).map((id) => (
                  <span
                    key={id}
                    className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                  >
                    {id}
                  </span>
                ))}
                {assets.length > SHOWN_ASSETS && (
                  <span className="px-2 py-0.5 text-xs text-gray-500">
                    {tr("detail.more", dict, {
                      count: formatCount(assets.length - SHOWN_ASSETS, lang),
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="justify-end">
          <Button color="alternative" onClick={onClose}>
            {tr("detail.close", dict)}
          </Button>
          {revocable && (
            <Button color="red" onClick={() => setConfirming(true)}>
              {tr("detail.revoke", dict)}
            </Button>
          )}
        </ModalFooter>
      </Modal>
      <ConfirmationModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void revoke()}
        isProcessing={busy}
        variant="danger"
        title={tr("detail.revokeTitle", dict)}
        description={tr("detail.revokeBody", dict, {
          target: target?.name ?? share.targetOrg,
          source: source?.name ?? share.sourceOrg,
        })}
        confirmLabel={tr("detail.revoke", dict)}
      />
    </>
  );
}
