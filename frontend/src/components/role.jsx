function Role({ name, icon, description, onClick }) {
  return (
    <button
      type="button"
      className="role-card"
      onClick={onClick}
    >
      <i className={`bi ${icon} role-icon`}></i>

      <h3>{name}</h3>

      <p>{description}</p>
    </button>
  );
}

export default Role;