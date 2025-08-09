import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, useAnimation } from "framer-motion";
import Select from "react-select"; // ✅ ensure this is installed

const RemoveStudent = () => {
   const [showForm, setShowForm] = useState(false);
   const [studentOptions, setStudentOptions] = useState([]);
   const [selectedScholarIds, setSelectedScholarId] = useState([]);
   const [message, setMessage] = useState("");
   const [errorMessage, setErrorMessage] = useState("");

   const token = localStorage.getItem("token");

   const leftControls = useAnimation();
   const rightControls = useAnimation();
   const ref = useRef();

   // ✅ Fetch student emails
   // useEffect(() => {
   //   const fetchEmails = async () => {
   //     try {
   //       const res = await axios.get(
   //         "http://localhost:5000/api/details/allStudentEmails",
   //         {
   //           headers: {
   //             Authorization: `Bearer ${token}`,
   //           },
   //         }
   //       );

   //       if (res.data.emails && Array.isArray(res.data.emails)) {
   //         const options = res.data.emails.map((email) => ({
   //           label: email,
   //           value: email,
   //         }));
   //         setStudentOptions(options);
   //       } else {
   //         console.warn("Unexpected response:", res.data);
   //       }
   //     } catch (err) {
   //       console.error("Error fetching student emails:", err);
   //     }
   //   };

   //   fetchEmails();
   // }, [token]);

   //  Fetch student Scholar Ids
   useEffect(() => {
      const fetchScholarId = async () => {
         try {
            const res = await axios.get(
               "http://localhost:5000/api/details/allStudentScholarId",
               {
                  headers: {
                     Authorization: `Bearer ${token}`,
                  },
               }
            );

            if (res.data.scholarIds && Array.isArray(res.data.scholarIds)) {
               const options = res.data.scholarIds.map((scholarId) => ({
                  label: scholarId,
                  value: scholarId,
               }));
               setStudentOptions(options);
            } else {
               console.warn("Unexpected response:", res.data);
            }
         } catch (err) {
            console.error("Error fetching student scholarId:", err);
         }
      };

      fetchScholarId();
   }, [token]);

   useEffect(() => {
      const observer = new IntersectionObserver(
         ([entry]) => {
            if (entry.isIntersecting) {
               leftControls.start({ opacity: 1, x: 0 });
               rightControls.start({ opacity: 1, x: 0 });
            }
         },
         { threshold: 0.3 }
      );

      if (ref.current) observer.observe(ref.current);
      return () => observer.disconnect();
   }, [leftControls, rightControls]);

   // ✅ Remove selected students
   const handleRemove = async () => {
      if (selectedScholarIds.length === 0) {
         setErrorMessage("Please select at least one student.");
         return;
      }

      const token = localStorage.getItem("token");
      console.log("Token before request:", token);

      try {
         console.log("semail:", selectedScholarIds);
         const res = await axios.delete(
            "http://localhost:5000/api/examiner/remove",
            {
               headers: {
                  Authorization: `Bearer ${token}`,
               },
               data: {
                  schId: selectedScholarIds.map((s) => s.value),
               },
               withCredentials: true,
            }
         );
         // console.log("semail:",selectedScholarIds);
         console.log("Response:", res.data);
         setMessage(res.data.msg);

         setTimeout(() => {
            window.location.reload();
         }, 1000);
      } catch (err) {
         console.error("Remove error:", err);
         setMessage(err.response?.data?.msg || "Error occurred");
      }
   };

   return (
      <div className="container mt-5" ref={ref}>
         <div
            className="card shadow p-5"
            style={{
               maxWidth: "1240px",
               margin: "auto",
               transition: "transform 0.3s ease",
               cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
         >
            <div className="d-flex justify-content-between align-items-start flex-wrap">
               {/* Left Side - Form with motion */}
               <motion.div
                  style={{ flex: "1 1 55%" }}
                  initial={{ opacity: 0, x: -80 }}
                  animate={leftControls}
                  transition={{ duration: 0.7, ease: "easeOut" }}
               >
                  <h3 className="text-primary fw-bold mb-3 d-flex align-items-center">
                     <i className="bi bi-person-x-fill me-2 fs-4"></i> Remove
                     Student(s)
                  </h3>

                  <p className="text-muted mb-4" style={{ fontSize: "1.05rem" }}>
                     Select one or more student emails to{" "}
                     <strong>permanently remove</strong> them.
                  </p>

                  <button
                     className="btn btn-outline-primary mb-3"
                     onClick={() => setShowForm(!showForm)}
                  >
                     {showForm ? "Cancel" : "Remove"}
                  </button>

                  {showForm && (
                     <div className="p-4 border rounded bg-light">
                        <label className="form-label">Select Students</label>
                        <Select
                           options={studentOptions}
                           isMulti
                           value={selectedScholarIds}
                           onChange={(selected) => setSelectedScholarId(selected)}
                           placeholder="Choose students..."
                           className="mb-3"
                        />
                        <button className="btn btn-danger w-100" onClick={handleRemove}>
                           Confirm Remove
                        </button>
                        {errorMessage && (
                           <div className="alert alert-danger mt-2">{errorMessage}</div>
                        )}
                     </div>
                  )}

                  {message && (
                     <div
                        className="mt-3 alert alert-info"
                        style={{ maxWidth: "500px" }}
                     >
                        {message}
                     </div>
                  )}
               </motion.div>

               {/* Right Side - Image with motion */}
               <motion.div
                  style={{
                     flex: "1 1 35%",
                     textAlign: "center",
                     paddingTop: "20px",
                  }}
                  initial={{ opacity: 0, x: 80 }}
                  animate={rightControls}
                  transition={{ duration: 0.7, ease: "easeOut" }}
               >
                  <img
                     src="https://cdn-icons-png.flaticon.com/512/6861/6861362.png"
                     alt="Remove icon"
                     style={{ maxWidth: "140px", marginBottom: "20px" }}
                  />
                  <p className="text-secondary" style={{ fontSize: "0.95rem" }}>
                     Removing a student will revoke their test access and delete
                     related records.
                  </p>
               </motion.div>
            </div>
         </div>
      </div>
   );
};

export default RemoveStudent;
