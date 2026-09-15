export default function SpkDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="kavio-detail-shell">
      <style>{`
        .kavio-detail-shell > main { background: transparent !important; color: #F7F3E8 !important; }
        .kavio-detail-shell > main > section { max-width: 1500px !important; padding: 0 !important; }
        .kavio-detail-shell > main > section > section { background: linear-gradient(180deg, rgba(18,49,80,.98), rgba(7,30,55,.98)) !important; border-color: rgba(216,180,90,.34) !important; color: #F7F3E8 !important; }
        .kavio-detail-shell > main > section > section:first-of-type { background: transparent !important; border: 0 !important; box-shadow: none !important; }
        .kavio-detail-shell table { background: #F7F5EE !important; color: #172B43 !important; }
        .kavio-detail-shell th { background: linear-gradient(180deg,#153654,#102E4D) !important; color: #F0D48A !important; }
        .kavio-detail-shell td { color: #172B43 !important; }
        .kavio-detail-shell a { color: #F0D48A; }
      `}</style>
      {children}
    </div>
  );
}
