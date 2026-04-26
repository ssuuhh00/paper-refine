type Props = {
  title: string;
  subtitle: string;
};

export function Placeholder({ title, subtitle }: Props) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--ink-3)',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        stub
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{title}</h1>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>{subtitle}</p>
    </div>
  );
}
