export default function Avatar({ user, size = 48 }) {
  const style = {
    width: size, height: size,
    background: user?.color || '#4F86C6',
    fontSize: size * 0.4,
  };

  if (user?.photo) {
    return (
      <img
        src={user.photo}
        alt={user.name}
        className="avatar"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div className="avatar" style={style}>
      {(user?.name || '?')[0].toUpperCase()}
    </div>
  );
}
