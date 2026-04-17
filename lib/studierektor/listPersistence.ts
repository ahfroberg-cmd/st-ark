import type { SupervisorStudent } from "@/lib/mappers/studentData";

export async function downloadStudentList(students: SupervisorStudent[]): Promise<void> {
  const exportData = {
    exportedAt: new Date().toISOString(),
    students,
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `studierektor-lista-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseStudentListFile(file: File): Promise<SupervisorStudent[]> {
  const txt = await file.text();
  const data = JSON.parse(txt);
  if (data.students && Array.isArray(data.students)) {
    return data.students as SupervisorStudent[];
  }
  return [];
}
