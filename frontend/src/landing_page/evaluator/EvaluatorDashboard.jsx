import { useEffect, useState } from "react";
import axiosInstance from "../../api/axiosInstance";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const EvaluatorDashboard = () => {
   const [tests, setTests] = useState([]);
   const navigate = useNavigate();

   useEffect(() => {
      axiosInstance
         .get("/evaluator/tests", { withCredentials: true })
         .then((res) => setTests(res.data.tests))
         .catch((err) => {
            const status = err?.response?.status;
            if (status === 401) {
               toast.error("Session expired. Please login again.");
               navigate("/evaluator/login");
               return;
            }
            toast.error(err?.response?.data?.msg || "Could not fetch assigned tests");
         });
   }, [navigate]);

   const handleDeleteAccount = async () => {
      if (!window.confirm("Are you sure you want to delete your evaluator account? This cannot be undone.")) {
         return;
      }
      try {
         await axiosInstance.delete("/evaluator/me", { withCredentials: true });
         toast.success("Account deleted. Logging out...");
         setTimeout(() => navigate("/evaluator/login"), 1500);
      } catch (err) {
         toast.error("Error deleting account");
      }
   };

   return (
      <div className="container mt-5">
         <div className="card shadow-lg">
            <div className="card-header bg-primary text-white">
               <h3 className="mb-0">Assigned Tests</h3>
            </div>
            <div className="card-body">
               {tests.length === 0 ? (
                  <p className="text-muted">No tests assigned.</p>
               ) : (
                  <ul className="list-group">
                     {tests.map((test) => (
                        <li
                           key={test._id}
                           className="list-group-item d-flex justify-content-between align-items-center"
                        >
                           <span>
                              <strong>{test.title}</strong>{" "}
                              <span className="text-muted">
                                 ({test.department || "N/A"})
                              </span>
                           </span>
                           <button
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate(`/evaluator/test/${test._id}/attempts`)}
                           >
                              Review Submissions
                           </button>
                        </li>
                     ))}
                  </ul>
               )}
            </div>
         </div>
         {/* Delete Account Button */}
         <button
            className="btn btn-danger mt-4"
            onClick={handleDeleteAccount}
         >
            Delete My Account
         </button>
      </div>
   );
};

export default EvaluatorDashboard;
























// import { useEffect, useState } from "react";
// import axiosInstance from "../../api/axiosInstance";
// import { useNavigate } from "react-router-dom";
// import { toast } from "react-toastify";

// const EvaluatorDashboard = () => {
//    const [tests, setTests] = useState([]);
//    const navigate = useNavigate();

//    useEffect(() => {
//      axiosInstance
//        .get("/evaluator/tests")
//        .then((res) => setTests(res.data.tests))
//        .catch(() => toast.error("Could not fetch assigned tests"));
//    }, []);

//    const handleDeleteAccount = async () => {
//       if (!window.confirm("Are you sure you want to delete your evaluator account? This cannot be undone.")) {
//          return;
//       }
//       try {
//          await axiosInstance.delete("/evaluator/me");
//          toast.success("Account deleted. Logging out...");
//          setTimeout(() => navigate("/evaluator/login"), 1500);
//       } catch (err) {
//          toast.error("Error deleting account");
//       }
//    };

//    return (
//       <div className="container mt-5">
//          <div className="card shadow-lg">
//             <div className="card-header bg-primary text-white">
//                <h3 className="mb-0">Assigned Tests</h3>
//             </div>
//             <div className="card-body">
//                {tests.length === 0 ? (
//                   <p className="text-muted">No tests assigned.</p>
//                ) : (
//                   <ul className="list-group">
//                      {tests.map((test) => (
//                         <li
//                            key={test._id}
//                            className="list-group-item d-flex justify-content-between align-items-center"
//                         >
//                            <span>
//                               <strong>{test.title}</strong>{" "}
//                               <span className="text-muted">
//                                  ({test.department || "N/A"})
//                               </span>
//                            </span>
//                            <button
//                               className="btn btn-primary btn-sm"
//                               onClick={() => navigate(`/evaluator/test/${test._id}/attempts`)}
//                            >
//                               Review Submissions
//                            </button>
//                         </li>
//                      ))}
//                   </ul>
//                )}
//             </div>
//          </div>
//          {/* Delete Account Button */}
//          <button
//             className="btn btn-danger mt-4"
//             onClick={handleDeleteAccount}
//          >
//             Delete My Account
//          </button>
//       </div>
//    );
// };

// export default EvaluatorDashboard;






