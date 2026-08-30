import { useState } from "react";
import "./App.css";
import Role from "./components/Role";

function App() {
  const [selectedRole, setSelectedRole] = useState("");

  const roles = [
    {
      name: "Admin",
      icon: "bi-person-gear",
    },

    {
      name: "Librarian",
      icon: "bi-book",
    },

    {
      name: "Student",
      icon: "bi-mortarboard",
    },
    
  ];

  return (
    <div className="welcome-page">
      <div className="container py-5">

        <div className="text-center mb-5">
          <div className="logo">
            <i className="bi bi-book-half"></i>
          </div>

          <h1 className="fw-bold mb-1">
            LibSync
          </h1>

          <p className="text-muted mb-0">
            Library Management System
          </p>
        </div>

        <div className="text-center mb-4">
          <h2 className="fw-semibold">
            Please select from our services
          </h2>
        </div>

        <div className="row justify-content-center g-4">

          {roles.map((role) => (
            <div
              className="col-12 col-md-4"
              key={role.name}
            >
              <button
                type="button"
                className="role-card w-100"
                onClick={() => setSelectedRole(role.name)}
              >
                <i
                  className={`bi ${role.icon} role-icon`}
                ></i>

                <h3 className="fw-bold mt-3 mb-2">
                  {role.name}
                </h3>

                <p className="text-muted mb-0">
                  Access {role.name.toLowerCase()} portal
                </p>
              </button>
            </div>
          ))}

        </div>

        {selectedRole && (
          <div className="text-center mt-4">
            Selected:{" "}
            <strong>{selectedRole}</strong>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;