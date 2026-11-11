import PublicReaderPage from "./PublicReaderPage";

export default async function ReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicReaderPage key={id} userId={id} />;
}
