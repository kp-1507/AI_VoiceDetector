import React from "react";
import { Link } from "react-router-dom";

function Hero() {
  return (
    <div className="container py-3">
      <div className="row justify-content-center text-center">
        <div className="col-12 mb-1" style={{ marginTop: "1.7cm" }}>
          <div
            className="p-0"
            style={{
              border: "none",
              background: "transparent",
              borderRadius: 0,
              maxWidth: "735px",
              margin: "0 auto",
              padding: 0,
            }}
          >
            <div className="row g-2 align-items-stretch">
              <div className="col-12 col-lg-4">
                <div
                  className="h-100 p-3 d-flex flex-column justify-content-center align-items-center"
                  style={{
                    border: "1.5px solid #c7ccd4",
                    borderRadius: "18px",
                    background: "#ffffff",
                    minHeight: "328px",
                  }}
                >
                  <div style={{ fontSize: "3.4rem", color: "#8e96a0", lineHeight: 1 }}>
                    <i className="fa fa-file-audio-o" aria-hidden="true"></i>
                  </div>
                  <div className="mt-3" style={{ fontSize: "1.08rem", color: "#1f2937", fontWeight: 600 }}>
                    audio.mp3
                  </div>
                  <div
                    className="mt-2 px-4 py-1"
                    style={{
                      border: "2px solid #7bd4a2",
                      borderRadius: "12px",
                      background: "#e6f5ed",
                      color: "#065f46",
                      fontSize: "1.02rem",
                      fontWeight: 600,
                      lineHeight: 1.1,
                      minWidth: "75%",
                    }}
                  >
                    Real
                  </div>
                  <div className="mt-3" style={{ color: "#6b7280", fontSize: "1.04rem", fontWeight: 400 }}>
                    Detection complete
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-8">
                <div className="row g-2 h-100">
                  <div className="col-12">
                    <div
                      className="p-3 h-100 d-flex flex-wrap align-items-center"
                      style={{
                        border: "1.5px solid #c7ccd4",
                        borderRadius: "18px",
                        background: "#ffffff",
                        minHeight: "86px",
                        columnGap: "20px",
                      }}
                    >
                      <div className="d-flex align-items-center gap-2" style={{ color: "#1f2937", fontSize: "1.2rem", fontWeight: 500 }}>
                        <i className="fa fa-users" aria-hidden="true" style={{ color: "#8e96a0" }}></i>
                        <span>Detections</span>
                      </div>
                      <div className="ms-auto" style={{ fontSize: "1.95rem", fontWeight: 500, color: "#111827", lineHeight: 1 }}>1.42L</div>
                      <div style={{ fontSize: "1.95rem", fontWeight: 500, color: "#111827", lineHeight: 1 }}>25.3k</div>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="row g-2">
                      <div className="col-12 col-xl-7">
                        <div
                          className="p-3"
                          style={{
                            border: "1.5px solid #c7ccd4",
                            borderRadius: "18px",
                            background: "#ffffff",
                            minHeight: "232px",
                          }}
                        >
                          <div style={{ fontSize: "1.05rem", color: "#1f2937", textAlign: "left", fontWeight: 500 }}>Detection Result</div>
                          <div className="mt-2" style={{ fontSize: "1.85rem", textAlign: "left", color: "#111827", fontWeight: 600 }}>
                            72,5% <span style={{ fontSize: "1.7rem" }}>Real</span>
                          </div>

                          <div className="mt-3" style={{ height: "14px", borderRadius: "5px", overflow: "hidden", display: "flex", maxWidth: "96%" }}>
                            <div style={{ width: "72%", background: "#45c97a" }} />
                            <div style={{ width: "28%", background: "#ff5e57" }} />
                          </div>

                          <div className="mt-3 d-flex justify-content-between align-items-center flex-wrap gap-1" style={{ fontSize: "0.9rem" }}>
                            <div style={{ color: "#111827" }}>
                              <i className="fa fa-square me-2" aria-hidden="true" style={{ color: "#45c97a" }}></i>
                              Real
                            </div>
                            <div style={{ color: "#111827" }}>
                              <i className="fa fa-square me-2" aria-hidden="true" style={{ color: "#ff5e57" }}></i>
                              AI Cloned
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-12 col-xl-5">
                        <div
                          className="p-3"
                          style={{
                            border: "1.5px solid #c7ccd4",
                            borderRadius: "18px",
                            background: "#ffffff",
                            minHeight: "212px",
                          }}
                        >
                          <div style={{ fontSize: "1.16rem", color: "#1f2937", textAlign: "left", fontWeight: 500 }}>Detection Statistics</div>
                          <div className="d-flex justify-content-center mt-1">
                            <div
                              style={{
                                width: "132px",
                                height: "132px",
                                borderRadius: "50%",
                                background: "conic-gradient(#2b6fdf 72%, #d5e3fb 72% 100%)",
                                display: "grid",
                                placeItems: "center",
                              }}
                            >
                              <div
                                style={{
                                  width: "94px",
                                  height: "94px",
                                  borderRadius: "50%",
                                  background: "#fff",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#111827",
                                }}
                              >
                                <div style={{ fontSize: "1.42rem", fontWeight: 600, lineHeight: 1 }}>72%</div>
                                <div style={{ fontSize: "1rem", lineHeight: 1.1 }}>Real</div>
                              </div>
                            </div>
                          </div>
                          <div className="mt-2" style={{ color: "#111827", fontSize: "1.02rem", textAlign: "left", lineHeight: 1.25 }}>
                            <div>
                              <i className="fa fa-square me-2" aria-hidden="true" style={{ color: "#45c97a" }}></i>
                              Real
                            </div>
                            <div>
                              <i className="fa fa-square me-2" aria-hidden="true" style={{ color: "#ff5e57" }}></i>
                              AI Cloned
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <h1 className="mt-3 fw-bold" style={{ fontFamily: "'Playfair Display', serif", fontSize: "3rem" }}>
          Smarter Viva Evaluations with AI
        </h1>

        <p style={{ fontSize: "0.92rem", marginTop: "6px", marginBottom: "10px" }}>
          Professors craft personalized, time-bound viva exams while students respond via voice - with instant AI insights revealing answer authenticity and depth.
        </p>

        <Link to="/">
          <button className="p-2 btn btn-primary fs-5" style={{ width: "20%", margin: "0 auto", marginTop: "2px" }}>
            Signup Now
          </button>
        </Link>
      </div>
    </div>
  );
}

export default Hero;
