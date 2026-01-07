// src/constants/positions.ts
export const PREDEFINED_POSITIONS = [
  "Supervisor",
  "District 1",
  "District 1/2",
  "District 2", 
  "District 3",
  "District 4",
  "District 5",
  "District 5/6",
  "District 6",
  "District 7/8",
  "District 9",
  "City-Wide",
  "Other (Custom)",
] as const;

export const RANK_ORDER = {
  'Chief': 1,
  'Deputy Chief': 2,
  'Lieutenant': 3,
  'Sergeant': 4,
  'Officer': 5,
  'Probationary': 6
} as const;

export const PTO_TYPES = [
  { value: "vacation", label: "Vacation", column: "vacation_hours" },
  { value: "holiday", label: "Holiday", column: "holiday_hours" },
  { value: "sick", label: "Sick", column: "sick_hours" },
  { value: "comp", label: "Comp", column: "comp_hours" },
] as const;
