import { useMode } from "@/lib/mode-context";
import { SimpleHome } from "@/components/home/SimpleHome";
import { AdvancedHome } from "@/components/home/AdvancedHome";

export default function Home() {
  const { mode } = useMode();
  return mode === "advanced" ? <AdvancedHome /> : <SimpleHome />;
}
