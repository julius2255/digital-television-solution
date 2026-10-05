import React from "react";
import OutputClient from "./OutputClient";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] || "" : v || "";
}

export default async function ProgramOutput({ searchParams }: Props) {
  const q = await searchParams;
  const name = one(q.name) || "CHEMCHEM TV KENYA — LIVE OUTPUT";
  const monitor = one(q.monitor) === "1";
  return <OutputClient name={name} monitor={monitor} />;
}
