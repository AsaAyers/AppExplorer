"use client";

import React from "react";

import Loading from "@/app/(miro)/loading";
import { getMiroAdapter } from "@/utils/miro/adapter";

export default function AuthDonePage() {
  React.useEffect(() => {
    getMiroAdapter().closeModal(true);
  }, []);

  return <Loading />;
}
