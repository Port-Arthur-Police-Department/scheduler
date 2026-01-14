// src/components/ui/color-picker.tsx
import { useState } from "react";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import { Check, Palette } from "lucide-react";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export const ColorPicker = ({ value, onChange }: ColorPickerProps) => {
  const [color, setColor] = useState(value);

  const presetColors = [
    "#2980b9", "#3498db", "#2ecc71", "#f1c40f", "#e74c3c", "#9b59b6",
    "#1abc9c", "#d35400", "#34495e", "#7f8c8d", "#ffffff", "#000000"
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start"
        >
          <div 
            className="w-4 h-4 mr-2 rounded border" 
            style={{ backgroundColor: color }}
          />
          {color}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-4">
          <div className="grid grid-cols-6 gap-2">
            {presetColors.map((presetColor) => (
              <button
                key={presetColor}
                className="w-6 h-6 rounded border hover:scale-110 transition-transform"
                style={{ backgroundColor: presetColor }}
                onClick={() => {
                  setColor(presetColor);
                  onChange(presetColor);
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                onChange(e.target.value);
              }}
              className="h-10"
            />
            <Input
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                onChange(e.target.value);
              }}
              placeholder="#000000"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
