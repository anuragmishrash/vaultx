import { useIsMobile } from '../../hooks/useMediaQuery';

export default function MobilePage({ title, headerRight, children }) {
  const isMobile = useIsMobile();

  if (!isMobile) return <>{children}</>;

  return (
    <div className="page-content" style={{ minHeight: '100vh' }}>
      {/* Mobile page header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 12px', marginBottom: '4px',
      }}>
        <h1 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '22px', letterSpacing: '-0.02em', color: '#EAEDF5', margin: 0 }}>
          {title}
        </h1>
        {headerRight && <div>{headerRight}</div>}
      </div>

      {/* Page content */}
      <div style={{ padding: '0 14px' }}>
        {children}
      </div>
    </div>
  );
}
