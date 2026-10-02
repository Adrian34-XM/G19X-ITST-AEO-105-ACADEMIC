import { notFound } from "next/navigation";
import { AccountAccess } from "@/components/account-access";

export const dynamic = "force-dynamic";
export const metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ flow: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { flow } = await params;
  if (flow !== "recover" && flow !== "confirm" && flow !== "password")
    notFound();
  const query = await searchParams;
  return (
    <AccountAccess
      mode={flow}
      code={typeof query.code === "string" ? query.code : undefined}
      token={
        typeof query.token_hash === "string" ? query.token_hash : undefined
      }
      type={typeof query.type === "string" ? query.type : undefined}
    />
  );
}
