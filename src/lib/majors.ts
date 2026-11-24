// The fixed list of majors. A shared question can only be reviewed by an instructor
// with the same major as its author, so majors must match exactly: no free text.
// Keep in sync with the Major enum in prisma/schema.prisma.

export const MAJORS = [
  { value: "MATHEMATICS", label: "Mathematics" },
  { value: "COMPUTER_SCIENCE", label: "Computer Science" },
  { value: "PHYSICS", label: "Physics" },
  { value: "CHEMISTRY", label: "Chemistry" },
  { value: "BIOLOGY", label: "Biology" },
  { value: "ENGINEERING", label: "Engineering" },
  { value: "MEDICINE", label: "Medicine" },
  { value: "PHARMACY", label: "Pharmacy" },
  { value: "BUSINESS", label: "Business & Management" },
  { value: "ECONOMICS", label: "Economics" },
  { value: "LANGUAGES", label: "Languages & Literature" },
  { value: "EDUCATION", label: "Education" },
  { value: "PSYCHOLOGY", label: "Psychology" },
  { value: "LAW", label: "Law" },
  { value: "ARTS", label: "Arts & Design" },
] as const;

export type MajorValue = (typeof MAJORS)[number]["value"];

export const MAJOR_VALUES = MAJORS.map((m) => m.value) as [MajorValue, ...MajorValue[]];

export function majorLabel(value: string | null | undefined): string {
  return MAJORS.find((m) => m.value === value)?.label ?? "No major set";
}
