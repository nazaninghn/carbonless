import { hourLabels } from "@/lib/mock-data";

export default function ChartAxis({ labels = hourLabels }) {
  return (
    <div className="flex justify-between px-[30px] mt-0.5">
      {labels.map((h) => (
        <span key={h} className="text-[10.5px] text-[#94A3B8] font-semibold">
          {h}
        </span>
      ))}
    </div>
  );
}
