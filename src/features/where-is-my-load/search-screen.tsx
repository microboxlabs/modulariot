import ParametrizedSearchBar from "../layout/components/secured-navbar/searchbar/parametrized-searchbar";
import { getNavegationParams } from "../layout/components/secured-navbar/searchbar/navegation_params";
import { I18nRecord } from "../i18n/i18n.service.types";

export default function SearchScreen({
  dict,
  messages,
  searchParams,
}: {
  dict: I18nRecord;
  messages: I18nRecord;
  searchParams: URLSearchParams;
}) {
  const navegation_params = getNavegationParams(dict, 1);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
      <h1 className="text-gray-700 dark:text-gray-200 font-bold text-2xl md:text-4xl text-center">
        Search for your load
      </h1>
      <h1 className="text-gray-600 dark:text-gray-400 font-light text-lg mb-4 text-center px-10 md:px-0">
        Use the searchbar to track the state of your load
      </h1>
      <ParametrizedSearchBar
        dict={dict}
        messages={messages}
        searchParams={searchParams}
        navegation_params={
          navegation_params[
            "where-is-my-load" as keyof typeof navegation_params
          ]
        }
        className="flex items-center gap-2 flex-col relative w-full md:w-fit"
      />
    </div>
  );
}
