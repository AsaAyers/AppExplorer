import { unsafeCSS } from "lit";
import styles from "mirotone/dist/styles.css";

import { createDebug } from "@/utils/create-debug";

const log = createDebug("app-explorer:mirotone");
export const mirotoneStyles = unsafeCSS(styles);
export const rawMirotoneStyles = styles;
