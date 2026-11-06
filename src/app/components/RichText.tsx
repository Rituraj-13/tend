const BOLD = /(\*\*[^*]+\*\*)/g;

export function RichText({ text }: { text: string }) {
  const parts = text.split(BOLD);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
