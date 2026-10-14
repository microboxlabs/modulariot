"use client";

import { useState } from "react";
import {
  Alert,
  Badge,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
} from "flowbite-react";
import {
  HiOutlineSearch,
  HiOutlineTruck,
  HiOutlineUserGroup,
} from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ApiError } from "../data/json-client";
import { CARD } from "../team/module-access";
import { useMyAccess } from "../team/team-api";
import { formatDate } from "../team/team-members-tab";
import {
  accessExpiresAt,
  accessReasons,
  filterAssets,
  useNetworkAssets,
  useNetworkRelationships,
  type NetworkAsset,
  type NetworkRelationship,
} from "./network-api";

const VIEW = "fleet:network.view";

interface NetworkPageProps {
  /** `pages.userSettings` subtree. */
  readonly dict: I18nRecord;
  readonly lang: string;
}

interface SectionProps {
  readonly d: I18nRecord;
  readonly lang: string;
}

function label(group: string, key: string, d: I18nRecord): string {
  return trDynamic(`${group}.${key}`, d);
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  readonly icon: typeof HiOutlineTruck;
  readonly title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-blue-500" />
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>
    </div>
  );
}

function RelationshipRow({
  relationship,
  d,
  lang,
}: SectionProps & { readonly relationship: NetworkRelationship }) {
  return (
    <TableRow className="bg-white dark:bg-gray-800">
      <TableCell className="font-medium text-gray-900 dark:text-white">
        {relationship.counterpart.name}
        <div className="text-xs font-normal text-gray-500 dark:text-gray-400">
          {label("roles", relationship.counterpartRole, d)}
        </div>
      </TableCell>
      <TableCell>
        {label("kinds", relationship.kind, d)}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {tr("youAre", d)} {label("roles", relationship.role, d).toLowerCase()}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {relationship.sources.map((source) => (
            <Badge key={source} color="gray">
              {label("sources", source, d)}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>{relationship.assetCount}</TableCell>
      <TableCell>{formatDate(relationship.firstSeen, lang)}</TableCell>
      <TableCell>{formatDate(relationship.lastSeen, lang)}</TableCell>
      <TableCell>{formatDate(relationship.expiresAt, lang)}</TableCell>
      <TableCell>
        <Badge
          color={relationship.active ? "success" : "gray"}
          className="w-fit"
        >
          {relationship.active ? tr("active", d) : tr("expired", d)}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

function RelationshipsSection({
  relationships,
  d,
  lang,
}: SectionProps & { readonly relationships: NetworkRelationship[] }) {
  return (
    <section className={`${CARD} flex flex-col gap-4 p-5`}>
      <SectionTitle
        icon={HiOutlineUserGroup}
        title={tr("relationshipsTitle", d)}
      />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {tr("relationshipsDescription", d)}
      </p>
      {relationships.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("noRelationships", d)}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>{tr("organization", d)}</TableHeadCell>
              <TableHeadCell>{tr("relationship", d)}</TableHeadCell>
              <TableHeadCell>{tr("evidence", d)}</TableHeadCell>
              <TableHeadCell>{tr("assets", d)}</TableHeadCell>
              <TableHeadCell>{tr("firstSeen", d)}</TableHeadCell>
              <TableHeadCell>{tr("lastSeen", d)}</TableHeadCell>
              <TableHeadCell>{tr("expiresAt", d)}</TableHeadCell>
              <TableHeadCell>{tr("status", d)}</TableHeadCell>
            </TableHead>
            <TableBody className="divide-y">
              {relationships.map((relationship) => (
                <RelationshipRow
                  key={`${relationship.kind}-${relationship.counterpart.id}`}
                  relationship={relationship}
                  d={d}
                  lang={lang}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function AssetRow({
  asset,
  d,
  lang,
}: SectionProps & { readonly asset: NetworkAsset }) {
  const references = [
    ...new Set(asset.access.map((a) => a.reference).filter(Boolean)),
  ];
  return (
    <TableRow className="bg-white dark:bg-gray-800">
      <TableCell className="font-mono font-medium text-gray-900 dark:text-white">
        {asset.id}
        {asset.label && (
          <div className="font-sans text-xs font-normal text-gray-500 dark:text-gray-400">
            {asset.label}
          </div>
        )}
      </TableCell>
      <TableCell>{asset.type ?? "—"}</TableCell>
      <TableCell>{asset.owner?.name ?? tr("unknownOwner", d)}</TableCell>
      <TableCell>
        {asset.providers.map((p) => p.name).join(", ") || "—"}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {accessReasons(asset).map((reason) => (
            <Badge key={reason} color="info">
              {label("reasons", reason, d)}
            </Badge>
          ))}
        </div>
        {references.length > 0 && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {references.join(", ")}
          </div>
        )}
      </TableCell>
      <TableCell>{formatDate(accessExpiresAt(asset), lang, "—")}</TableCell>
    </TableRow>
  );
}

function AssetsSection({
  assets,
  d,
  lang,
}: SectionProps & { readonly assets: NetworkAsset[] }) {
  const [search, setSearch] = useState("");
  const visible = filterAssets(assets, search);
  return (
    <section className={`${CARD} flex flex-col gap-4 p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle icon={HiOutlineTruck} title={tr("assetsTitle", d)} />
        <TextInput
          icon={HiOutlineSearch}
          sizing="sm"
          placeholder={tr("searchAssets", d)}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {tr("assetsDescription", d)}
      </p>
      {visible.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("noAssets", d)}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>{tr("asset", d)}</TableHeadCell>
              <TableHeadCell>{tr("type", d)}</TableHeadCell>
              <TableHeadCell>{tr("owner", d)}</TableHeadCell>
              <TableHeadCell>{tr("providers", d)}</TableHeadCell>
              <TableHeadCell>{tr("why", d)}</TableHeadCell>
              <TableHeadCell>{tr("visibleUntil", d)}</TableHeadCell>
            </TableHead>
            <TableBody className="divide-y">
              {visible.map((asset) => (
                <AssetRow key={asset.id} asset={asset} d={d} lang={lang} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function errorMessage(error: Error, d: I18nRecord): string {
  if (error instanceof ApiError && error.status === 503)
    return tr("unavailable", d);
  return tr("loadFailed", d);
}

/** Settings › Asset network: the organization's assets and who it shares them with. */
export default function NetworkPage({ dict, lang }: NetworkPageProps) {
  const d = (dict?.network as I18nRecord) ?? {};
  const { access, accessError, can } = useMyAccess();
  const allowed = can(VIEW);
  const relationships = useNetworkRelationships(allowed);
  const assets = useNetworkAssets(allowed);
  const error = accessError ?? relationships.error ?? assets.error;
  const loading =
    !error && (!access || relationships.isLoading || assets.isLoading);
  const ready = !loading && !error && allowed;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={dict?.breadcrumb as I18nRecord}
          lang={lang}
          path={["user", "settings", "network"]}
          disableLinks
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto dark:bg-gray-900">
        <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-5 px-4 pt-5 pb-10">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {tr("title", d)}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {tr("description", d)}
            </p>
          </div>
          {loading && <Spinner className="mx-auto" />}
          {error && <Alert color="gray">{errorMessage(error, d)}</Alert>}
          {!loading && !error && !allowed && (
            <Alert color="gray">{tr("notAllowed", d)}</Alert>
          )}
          {ready && (
            <>
              <RelationshipsSection
                relationships={relationships.data ?? []}
                d={d}
                lang={lang}
              />
              <AssetsSection assets={assets.data ?? []} d={d} lang={lang} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
