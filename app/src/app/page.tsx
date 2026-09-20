import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Rot() {
  const okt = await auth();
  redirect(okt?.user?.id ? "/hjem" : "/logg-inn");
}
