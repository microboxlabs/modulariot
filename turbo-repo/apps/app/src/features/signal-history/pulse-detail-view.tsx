import { HistoricSignal } from "./types/historic-signal.type";
import { I18nRecord } from "../i18n/i18n.service.types";
import { tr } from "../i18n/tr.service";
import { FormattedDate } from "../common/components/formatted-date";
import { memo } from "react";

type PulseDetailViewProps = {
  pulse: HistoricSignal;
  dict: I18nRecord;
};

const PulseDetailView = memo(function PulseDetailView({
  pulse,
  dict,
}: Readonly<PulseDetailViewProps>) {
  const googleMapsUrl = `https://www.google.com/maps?q=${pulse.latitude},${pulse.longitude}`;

  return (
    <div className="bg-white dark:bg-gray-800 px-3 pb-3 rounded-lg">
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {tr("signal_historic.assetid", dict)}:{" "}
        <span className="font-light">{pulse.assetid || "-"}</span>
      </div>
      <hr className="my-2 border-gray-200 dark:border-gray-700" />
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {tr("signal_historic.timestamp", dict)}:{" "}
        <span className="font-light">
          <FormattedDate date={new Date(pulse.timestamp)} />
        </span>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {tr("signal_historic.tripid", dict)}:{" "}
        <span className="font-light">
          {pulse.tripid !== "null" && pulse.tripid
            ? pulse.tripid
            : tr("signal_historic.no_trip", dict)}
        </span>
      </div>
      <hr className="my-2 border-gray-200 dark:border-gray-700" />
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {tr("signal_historic.speed", dict)}:{" "}
        <span className="font-light">{pulse.speed || 0} km/h</span>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {tr("signal_historic.distance", dict)}:{" "}
        <span className="font-light">
          {((pulse.distance || 0) / 1000).toFixed(1)} km
        </span>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {tr("signal_historic.heading", dict)}:{" "}
        <span className="font-light">{pulse.heading || 0}°</span>
      </div>
      <hr className="my-2 border-gray-200 dark:border-gray-700" />
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {tr("signal_historic.latitude", dict)}:{" "}
        <span className="font-light">{pulse.latitude.toFixed(6)}</span>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {tr("signal_historic.longitude", dict)}:{" "}
        <span className="font-light">{pulse.longitude.toFixed(6)}</span>
      </div>
      <hr className="my-2 border-gray-200 dark:border-gray-700" />
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
      >
        {tr("signal_historic.view_on_maps", dict)}
      </a>
    </div>
  );
});

export default PulseDetailView;
