"use server";

import invariant from "tiny-invariant";

import { isPaid } from "@/utils/is-paid";
import prisma from "@/utils/prisma";
import { readSession } from "@/utils/session";

export async function setPaid() {
  const { userId } = await readSession();
  invariant(userId, "missing userId");

  if (await isPaid(userId)) {
    return "already paid";
  }

  prisma.payment.create({
    data: {
      user: {
        connectOrCreate: {
          create: {
            id: String(userId),
          },
          where: {
            id: String(userId),
          },
        },
      },
    },
  });
}

export default async function UpgradePage() {
  return <div>Upgrade Now</div>;
}
