import "./pictulab.css";

export const metadata = {
  title: "Panel PicTULAB — Kreative 360º",
  description: "Panel interno para generación de imágenes con referencia",
};

export default function PictuLabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pictulab-wrapper">
      {children}
    </div>
  );
}
