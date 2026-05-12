// src/utils/positionUtils.ts
import { PREDEFINED_POSITIONS } from "@/constants/positions";

export const DISPATCH_POSITIONS = [
  "Dispatch-A",
  "Dispatch-B",
  "Dispatch Supervisor",
  "Dispatch Radio",
  "Dispatch Call Taker",
  "Dispatch Data Entry",
];

export const getPositionsForShift = (shiftName?: string): string[] => {
  if (!shiftName) return [...PREDEFINED_POSITIONS];
  
  const shiftNameLower = shiftName.toLowerCase();
  
  // Check if this is a Dispatch shift
  if (shiftNameLower.includes('dispatch-a') || shiftNameLower.includes('dispatch a')) {
    return [...DISPATCH_POSITIONS, "Other (Custom)"];
  }
  
  if (shiftNameLower.includes('dispatch-b') || shiftNameLower.includes('dispatch b')) {
    return [...DISPATCH_POSITIONS, "Other (Custom)"];
  }
  
  // For regular shifts, use standard positions
  return [...PREDEFINED_POSITIONS];
};

export const isDispatchShift = (shiftName?: string): boolean => {
  if (!shiftName) return false;
  const shiftNameLower = shiftName.toLowerCase();
  return shiftNameLower.includes('dispatch-a') || 
         shiftNameLower.includes('dispatch b') ||
         shiftNameLower.includes('dispatch');
};
