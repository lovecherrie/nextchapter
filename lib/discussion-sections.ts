export function discussionSectionLabel(value: string | null | undefined) {
  if (value === "epilogue") return "Epilogue";
  if (value && /^chapter:([1-9][0-9]{0,2}|1000)$/.test(value)) return `Chapter ${value.slice(8)}`;
  return null;
}
