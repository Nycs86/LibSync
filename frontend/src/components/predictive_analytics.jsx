import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import "./predictive_analytics.css";

function MetricCard({ label, value, note, icon }) {
  return (
    <article className="predictive-metric-card">
      <span className="predictive-metric-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function getPredictiveErrorMessage(requestError) {
  if (requestError?.message === "Failed to fetch") {
    return "Cannot connect to the LibSync API on Render. Check that the Render backend is live and that the latest backend changes have been deployed, then retry.";
  }
  return requestError?.message || "Unable to load predictive analytics.";
}

function PredictiveAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadModel = useCallback(async () => {
    try {
      const result = await api.get("/api/admin/predictive-analytics");
      setData(result);
      setError("");
    } catch (requestError) {
      setError(getPredictiveErrorMessage(requestError));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial page load: avoid calling a state-updating callback directly in the effect.
  useEffect(() => {
    let isActive = true;

    api
      .get("/api/admin/predictive-analytics")
      .then((result) => {
        if (!isActive) return;
        setData(result);
        setError("");
      })
      .catch((requestError) => {
        if (!isActive) return;
        setError(getPredictiveErrorMessage(requestError));
        setData(null);
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError("");
    loadModel();
  }, [loadModel]);

  if (loading) {
    return <section className="predictive-panel predictive-loading">Training the Decision Tree from borrowing history...</section>;
  }

  if (error) {
    return (
      <section className="predictive-panel">
        <div className="predictive-heading-row">
          <div><span className="predictive-eyebrow">MACHINE LEARNING</span><h2>Student Late-Return Prediction</h2></div>
          <button type="button" className="predictive-refresh" onClick={handleRefresh}><i className="bi bi-arrow-clockwise" /> Retry</button>
        </div>
        <div className="predictive-alert predictive-alert-error">{error}</div>
        <p className="predictive-muted">If the error mentions a missing dependency, install the updated backend requirements and restart Flask.</p>
      </section>
    );
  }

  const training = data?.training || {};
  const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
  const featureImportance = Array.isArray(data?.feature_importance) ? data.feature_importance : [];
  const trained = training.status === "trained_prototype";

  return (
    <div className="predictive-page">
      <section className="predictive-panel predictive-intro-panel">
        <div className="predictive-heading-row">
          <div>
            <span className="predictive-eyebrow">MACHINE LEARNING / DSA</span>
            <h2>Student Late-Return Prediction</h2>
            <p>Experimental Decision Tree model trained from completed LibSync borrowing batches.</p>
          </div>
          <button type="button" className="predictive-refresh" onClick={handleRefresh} disabled={loading}>
            <i className="bi bi-arrow-clockwise" /> Refresh & Train
          </button>
        </div>
        <div className="predictive-model-meta">
          <span><i className="bi bi-diagram-3" /> {data?.model?.algorithm || "Decision Tree Classifier"}</span>
          <span><i className="bi bi-arrow-repeat" /> Retrains using current database history when this page loads</span>
          <span className={`predictive-status ${trained ? "is-trained" : "is-pending"}`}>
            {trained ? "Prototype trained" : "More data needed"}
          </span>
        </div>
      </section>

      <section className="predictive-metric-grid">
        <MetricCard label="Training examples" value={training.examples ?? 0} note="Past batches with earlier student history" icon="bi-database" />
        <MetricCard label="On-time examples" value={training.on_time_examples ?? 0} note="Classified as ON TIME" icon="bi-check-circle" />
        <MetricCard label="Late examples" value={training.late_examples ?? 0} note="Classified as LATE" icon="bi-clock-history" />
        <MetricCard label="Students represented" value={training.students_represented ?? 0} note="Students in the training data" icon="bi-people" />
      </section>

      {!trained && (
        <section className="predictive-alert predictive-alert-warning">
          <strong>Training is not available yet.</strong>
          <span>{training.message || "Collect more completed borrowing records with both on-time and late outcomes."}</span>
        </section>
      )}

      {trained && (
        <>
          <section className="predictive-panel">
            <div className="predictive-heading-row">
              <div><h3>Current released-batch predictions</h3><p>Predictions are based only on each student's earlier completed borrowing history.</p></div>
              <span className="predictive-count">{predictions.length} active batch{predictions.length === 1 ? "" : "es"}</span>
            </div>
            {predictions.length === 0 ? (
              <div className="predictive-empty">There are no released borrowing batches awaiting return right now.</div>
            ) : (
              <div className="predictive-table-wrap">
                <table className="predictive-table">
                  <thead><tr><th>Batch</th><th>Student</th><th>Books</th><th>Previous batches</th><th>Previous late rate</th><th>Prediction</th><th>Class probability</th></tr></thead>
                  <tbody>
                    {predictions.map((item) => (
                      <tr key={item.batch_id}>
                        <td>#{item.batch_id}</td>
                        <td><strong>{item.student_name}</strong><small>ID: {item.user_id}</small></td>
                        <td>{item.book_count}</td>
                        <td>{item.previous_completed_batches ?? "—"}</td>
                        <td>{item.previous_late_rate == null ? "—" : `${item.previous_late_rate}%`}</td>
                        <td>
                          {item.prediction ? (
                            <span className={`predictive-outcome ${item.prediction === "LATE" ? "is-late" : "is-ontime"}`}>{item.prediction}</span>
                          ) : <span className="predictive-outcome is-unavailable">Unavailable</span>}
                          {item.message && <small className="predictive-cell-note">{item.message}</small>}
                        </td>
                        <td>{item.predicted_class_probability == null ? "—" : `${item.predicted_class_probability}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="predictive-panel">
            <div className="predictive-heading-row">
              <div><h3>Feature importance</h3><p>Relative contribution of each input feature to this fitted Decision Tree.</p></div>
            </div>
            {featureImportance.length === 0 ? <div className="predictive-empty">Feature importance is not available.</div> : (
              <div className="predictive-feature-list">
                {featureImportance.map((item) => (
                  <div className="predictive-feature-row" key={item.feature}>
                    <div><span>{item.feature.replaceAll("_", " ")}</span><strong>{(item.importance * 100).toFixed(1)}%</strong></div>
                    <div className="predictive-feature-track"><span style={{ width: `${Math.max(0, Math.min(100, item.importance * 100))}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section className="predictive-disclaimer">
        <i className="bi bi-info-circle" aria-hidden="true" />
        <div>
          <strong>Prototype limitation and responsible use</strong>
          <p>{training.evaluation_message || "Predictions are experimental and should not be treated as a definitive judgment of a student."}</p>
          <p>The model does not change borrowing approvals, student performance scores, or existing return-performance calculations. Use predictions only as an early reminder/support signal.</p>
        </div>
      </section>
    </div>
  );
}

export default PredictiveAnalytics;
