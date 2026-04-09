import classNames from "classnames";

export const installExtension = (
  <button
    disabled
    title="Launching soon"
    className={classNames(
      // " hover:bg-blue-700 bg-blue-600 text-white "
      "bg-gray-400  cursor-not-allowed  text-white",
      "relative  ml-auto ",
      "inline-flex items-center justify-center mx-2 px-6 py-3 rounded-lg font-semibold transition-colors",
    )}
  >
    Install VS Code Extension
  </button>
);
export const installMiroApp = (
  <button
    disabled
    title="Launching soon"
    // href={
    //   "https://miro.com/app-install/?response_type=code&client_id=3458764531189693223&redirect_uri=%2Fapp-install%2Fconfirm%2F"
    // }
    className={classNames(
      "bg-gray-400  cursor-not-allowed  text-white",
      // "hover:bg-gray-300 ",
      // "bg-amber-300 text-black ",
      "inline-flex items-center justify-center mx-2 px-6 py-3  rounded-lg font-semibold transition-colors",
    )}
  >
    Authorize Miro App
  </button>
);
