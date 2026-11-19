import type { Metadata } from "next";
import { DemoView } from "@/components/demo-view";

export const metadata: Metadata = {
  title: "Demo workspace",
  description:
    "Explore RecallAI with a synthetic sample library. Search passages and see how cited answers are assembled.",
};

export default function DemoPage() {
  return <DemoView />;
}
