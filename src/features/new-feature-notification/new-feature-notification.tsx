import ClientNotification from "./client-notification";
import { getDictionary } from "../i18n/i18n.service";

/*
  This implementation will allow the user to define new "features" to show in a notification modal.
  Each feature will have an ID, title, description, and image/gif to show.

  The user can accept or decline each feature. The state will be stored in localStorage with the feature ID as key.

  If the user accepts a feature, we store "true" in localStorage for that feature ID.
  If the user declines a feature, we store "false" in localStorage for that feature ID.
  If the user has not seen the feature yet, there will be no entry in localStorage for that feature ID.

  Also the user will have the posibility to set "not show again" for each feature.

  This way, we can easily add new features in the future by just adding them to the "features" object below.
*/

export default async function NewFeatureNotification({
  lang,
}: {
  lang: string;
}) {
  const [, dict] = await getDictionary(lang);

  return <ClientNotification dict={dict} />;
}
