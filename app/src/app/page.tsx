import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { startside } from "@/lib/startside";

export default async function Rot() {
  const okt = await auth();
  redirect(okt?.user ? startside(okt.user.rolle) : "/logg-inn");
}
