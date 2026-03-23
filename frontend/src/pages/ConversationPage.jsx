import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import ConversationPane from "../components/ConversationPane";
import api from "../api/client";

function ConversationPage({ onLogout }) {
  const { id } = useParams();
  const discipleId = decodeURIComponent(id || "");
  const [disciple, setDisciple] = useState({ id: discipleId, discipleId });

  useEffect(() => {
    if (!discipleId) return;

    api
      .get(`/api/disciples/${encodeURIComponent(discipleId)}`)
      .then((res) => {
        setDisciple({ ...res.data, id: res.data?.id || discipleId, discipleId: res.data?.id || discipleId });
      })
      .catch(() => {
        setDisciple({ id: discipleId, discipleId });
      });
  }, [discipleId]);

  function handleDiscipleUpdate(patch) {
    if (!patch?.id) {
      return;
    }

    setDisciple((prev) => {
      if (!prev || prev.id !== patch.id) {
        return prev;
      }

      return { ...prev, ...patch };
    });
  }

  return (
    <Layout title="Conversation" onLogout={onLogout}>
      <div className="mb-3">
        <Link
          to={`/disciples/${encodeURIComponent(discipleId)}`}
          className="inline-flex items-center gap-1 rounded-lg border border-theme-border px-3 py-1.5 text-sm text-theme-text1"
        >
          <ArrowLeft size={14} /> Retour au profil
        </Link>
      </div>

      <div className="h-[calc(100vh-11rem)]">
        <ConversationPane
          disciple={disciple}
          className="h-full"
          showHeader
          onDiscipleUpdate={handleDiscipleUpdate}
        />
      </div>
    </Layout>
  );
}

export default ConversationPage;
