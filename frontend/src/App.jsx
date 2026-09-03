import { useState } from "react";
import "./App.css";
import Role from "./components/role";
import AdminLogin from "./components/admin_login";
import AdminDashboard from "./components/admin_dashboard";
import LibrarianLogin from "./components/librarian_login";
import LibrarianDashboard from "./components/librarian_dashboard";
import StudentLogin from "./components/student_login";

function App() {
  const [selectedRole, setSelectedRole] = useState("");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isLibrarianLoggedIn, setIsLibrarianLoggedIn] = useState(false);

  const roles = [
    {
      name: "Admin",
      icon: "bi-person-gear",
      description: "Access admin portal",
    },
    {
      name: "Librarian",
      icon: "bi-book",
      description: "Access librarian portal",
    },
    {
      name: "Student",
      icon: "bi-mortarboard",
      description: "Access student portal",
    },
  ];

  // Admin Dashboard
  if (isAdminLoggedIn) {
    return (
      <AdminDashboard
        onLogout={() => {
          localStorage.removeItem("loggedInUser");
          setIsAdminLoggedIn(false);
          setSelectedRole("");
        }}
      />
    );
  }

  // Librarian Dashboard
  if (isLibrarianLoggedIn) {
    return (
      <LibrarianDashboard
        onLogout={() => {
          localStorage.removeItem("loggedInUser");
          setIsLibrarianLoggedIn(false);
          setSelectedRole("");
        }}
      />
    );
  }

  // Admin Login
  if (selectedRole === "Admin") {
    return (
      <AdminLogin
        onBack={() => setSelectedRole("")}
        onLoginSuccess={() => setIsAdminLoggedIn(true)}
      />
    );
  }

  // Librarian Login
if (selectedRole === "Librarian") {
  return (
    <LibrarianLogin
      onBack={() => setSelectedRole("")}
      onLoginSuccess={() => setIsLibrarianLoggedIn(true)}
    />
  );
}

  // Student Login
  if (selectedRole === "Student") {
    return (
      <StudentLogin
        onBack={() => setSelectedRole("")}
      />
    );
  }

  return (
    <div className="welcome-page">
      <div className="container py-5">

        {/* Logo and Title */}
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

        {/* Select Role */}
        <div className="text-center mb-4">

          <h2 className="fw-semibold">
            Please select from our services
          </h2>

        </div>

        {/* Role Cards */}
        <div className="row justify-content-center g-4">

          {roles.map((role) => (
            <div
              className="col-12 col-md-4"
              key={role.name}
            >
              <Role
                name={role.name}
                icon={role.icon}
                description={role.description}
                onClick={() => setSelectedRole(role.name)}
              />
            </div>
          ))}

        </div>

      </div>
    </div>
  );
}

export default App;