import { notFound } from "next/navigation";
import { Gallery } from "./Gallery";

/** U-04: development only. Remove this folder before the feature freeze on 30/11/2026. */
export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Gallery />;
}
