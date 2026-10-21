import { notFound } from "next/navigation";

/**
 * Unknown /app/* URLs: route them to the panel's not-found page instead of
 * the customer one.
 */
export default function MissingStaffPage() {
  notFound();
}
