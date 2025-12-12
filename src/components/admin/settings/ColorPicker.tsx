// src/components/admin/settings/ColorPicker.tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rgbStringToHex } from "./colorUtils";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export const ColorPicker = ({ label, value, onChange }: ColorPickerProps) => {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="color"
          value={rgbStringToHex(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 p-1"
        />
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">RGB: {value}</div>
          <div className="text-sm">{rgbStringToHex(value)}</div>
        </div>
      </div>
    </div>
  );
};
