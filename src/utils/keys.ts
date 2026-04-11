import invariant from "tiny-invariant";

const secretKey = process.env.SESSION_SECRET;
invariant(typeof secretKey === "string", "Missing SESSION_SECRET");

let key = null as null | Uint8Array<ArrayBuffer>;
export const getSessionKey = () => {
  if (!key) {
    const hexValues = secretKey
      .match(/.{1,2}/g)
      ?.map((byte) => parseInt(byte, 16));
    invariant(hexValues, "Unable to parse hex values");

    key = new Uint8Array(hexValues);
  }
  return key;
};
