import { useState } from "react";
import "./App.css";

import Home from "./components/home";
import AdminLogin from "./components/admin_login";
import AdminDashboard from "./components/admin_dashboard";
import LibrarianLogin from "./components/librarian_login";
import LibrarianDashboard from "./components/librarian_dashboard";
import StudentLogin from "./components/student_login";
import StudentDashboard from "./components/student_dashboard";

function App() {
  const [selectedRole, setSelectedRole] = useState(() =>
    window.location.hash === "#admin-login" ? "Admin" : ""
  );

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isLibrarianLoggedIn, setIsLibrarianLoggedIn] = useState(false);
  const [isStudentLoggedIn, setIsStudentLoggedIn] = useState(false);

 
  if (isAdminLoggedIn) {
    return (
      <AdminDashboard
        onLogout={() => {
          sessionStorage.removeItem("loggedInUser");
          setIsAdminLoggedIn(false);
          setSelectedRole("");
        }}
      />
    );
  }

  if (isLibrarianLoggedIn) {
    return (
      <LibrarianDashboard
        onLogout={() => {
          sessionStorage.removeItem("loggedInUser");
          setIsLibrarianLoggedIn(false);
          setSelectedRole("");
        }}
      />
    );
  }

  if (isStudentLoggedIn) {
    return (
      <StudentDashboard
        onLogout={() => {
          sessionStorage.removeItem("loggedInUser");
          setIsStudentLoggedIn(false);
          setSelectedRole("");
        }}
      />
    );
  }

  if (selectedRole === "Admin") {
    return (
      <AdminLogin
        onBack={() => {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
          );
          setSelectedRole("");
        }}
        onLoginSuccess={() => {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
          );
          setIsAdminLoggedIn(true);
        }}
      />
    );
  }

  // LIBRARIAN LOGIN
  if (selectedRole === "Librarian") {
    return (
      <LibrarianLogin
        onBack={() => setSelectedRole("")}
        onLoginSuccess={() => setIsLibrarianLoggedIn(true)}
      />
    );
  }

  // STUDENT LOGIN
  if (selectedRole === "Student") {
    return (
      <StudentLogin
        onBack={() => setSelectedRole("")}
        onLoginSuccess={() => setIsStudentLoggedIn(true)}
      />
    );
  }

  // LIBSYNC HOMEPAGE
  return (
    <Home
      onSelectRole={(role) => setSelectedRole(role)}
    />
  );
}

export default App;