export default function MasivoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#ffffff",
        minHeight: "100vh",
        color: "#000",
        paddingTop: "0px",
      }}
    >
      {children}
    </div>
  );
}
