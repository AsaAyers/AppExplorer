"use server";

import invariant from "tiny-invariant";

import { isPaid } from "@/lib/is-paid";
import prisma from "@/lib/prisma";
import { readSession } from "@/lib/session";

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
