import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Text, View } from "react-native";

import { useLoader, useStore } from "@/components/hooks";
import { Body, Button, Card, Chip, Field, Label, Notice, Pill, s, Screen, Skeleton } from "@/components/ui";
import { fileBytes, prepareDocumentPhoto } from "@/lib/photos";
import { supabase } from "@/lib/supabase";

const STATE = {
  APPROVED: ["Approved", "done"],
  EXPIRING: ["Expires soon", "attention"],
  PENDING: ["Sentroh is checking", "active"],
  REJECTED: ["Not accepted", "stopped"],
  EXPIRED: ["Expired", "stopped"],
  MISSING: ["Not uploaded", "muted"],
};

const TYPES_FOR = {
  REGISTRATION: [["DTI", "DTI"], ["SEC", "SEC"], ["CDA", "CDA"]],
  MAYORS_PERMIT: [["MAYORS_PERMIT", "Mayor's permit"]],
  BIR_2303: [["BIR_2303", "BIR 2303"]],
  OPTIONAL: [["SANITARY_PERMIT", "Sanitary permit"], ["OTHER", "Other"]],
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const longDate = (ymd) => new Date(`${ymd}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

/**
 * Verified badge: the store uploads its papers; Sentroh checks them. The
 * store can sell before it is verified. Files are private (only Sentroh
 * admins can open them).
 */
export default function Verification() {
  const { storeId, call, canEdit, keyFor } = useStore();
  const { data, error, reload } = useLoader(() => call("/verification"), [storeId], { key: keyFor("/verification") });
  const [group, setGroup] = useState(null);
  const [docType, setDocType] = useState(null);
  const [number, setNumber] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const [done, setDone] = useState(null);

  if (!data) return <Screen>{error ? <Notice error={error} /> : <Skeleton kind="cards" rows={4} pad={0} what="Loading verification" />}</Screen>;
  const v = data.verification;

  function start(g) {
    setGroup(g); setDocType(TYPES_FOR[g][0][0]); setNumber(""); setExpiresOn(""); setFailure(null); setDone(null);
  }

  async function upload(fromCamera) {
    setFailure(null);
    if (expiresOn && !DATE.test(expiresOn.trim())) { setFailure(new Error("Write the expiry date like 2027-01-31.")); return; }
    const permission = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setFailure(new Error(fromCamera ? "Allow the camera to take a photo of the paper." : "Allow photo access to choose the photo.")); return; }
    const options = { mediaTypes: ["images"], quality: 1 };
    const picked = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled || !picked.assets?.[0]) return;

    setBusy(true);
    try {
      const photo = await prepareDocumentPhoto(picked.assets[0]);
      const contentType = "image/jpeg";
      const { upload: link } = await call("/verification/upload-url", { method: "POST", body: { docType, contentType } });
      const up = await supabase.storage.from("verification-docs").uploadToSignedUrl(link.path, link.token, await fileBytes(photo.uri), { contentType });
      if (up.error) throw new Error("The photo did not upload. Check your connection and try again.");
      await call("/verification/documents", {
        method: "POST",
        body: { docType, path: link.path, documentNumber: number.trim() || null, expiresOn: expiresOn.trim() || null },
      });
      setGroup(null);
      setDone("Sent. Sentroh will check it and tell you.");
      await reload();
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  }

  const form = group ? (
    <Card>
      <Label>Upload {group === "OPTIONAL" ? "another document" : v.required.find((r) => r.group === group)?.label}</Label>
      {TYPES_FOR[group].length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
          {TYPES_FOR[group].map(([t, text]) => <Chip key={t} label={text} active={docType === t} onPress={() => setDocType(t)} />)}
        </View>
      ) : null}
      <Field label="Number on the paper (optional)" value={number} onChangeText={setNumber} maxLength={60} autoCapitalize="characters" />
      <Field label={docType === "MAYORS_PERMIT" ? "Expiry date" : "Expiry date (if it has one)"} hint="Like 2027-01-31"
        value={expiresOn} onChangeText={setExpiresOn} maxLength={10} keyboardType="numbers-and-punctuation" />
      <Body muted style={{ marginBottom: 8 }}>Take a clear photo of the whole paper in good light, with no glare.</Body>
      <Button title="Take a photo" busy={busy} disabled={busy} onPress={() => upload(true)} />
      <Button title="Choose from gallery" kind="secondary" disabled={busy} style={{ marginTop: 8 }} onPress={() => upload(false)} />
      <Button title="Cancel" kind="secondary" disabled={busy} style={{ marginTop: 8 }} onPress={() => setGroup(null)} />
    </Card>
  ) : null;

  return (
    <Screen>
      <Card tone={v.isVerified ? undefined : "attention"}>
        <Pill text={v.isVerified ? "Verified" : "Not verified yet"} tone={v.isVerified ? "done" : "attention"} />
        <Body style={{ marginTop: 8 }}>
          {v.isVerified
            ? `Customers see the Verified badge on your store${v.verificationExpiresOn ? ` until ${longDate(v.verificationExpiresOn)}` : ""}. Upload renewed permits before they expire.`
            : "You can already sell. Upload these three papers to get the Verified badge, so customers know Sentroh checked your store."}
        </Body>
      </Card>
      <Notice kind="ok">{done}</Notice>
      <Notice error={failure} />
      {!canEdit ? <Notice kind="info">Only the owner or a manager can upload papers.</Notice> : null}

      {v.required.map((r) => {
        const [text, tone] = STATE[r.state] || STATE.MISSING;
        return (
          <View key={r.group}>
            <Card>
              <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-start" }]}>
                <Text style={[s.body, { fontWeight: "700", flex: 1, paddingRight: 8 }]}>{r.label}</Text>
                <Pill text={text} tone={tone} />
              </View>
              {r.expiresOn ? <Body muted>Valid until {longDate(r.expiresOn)}</Body> : null}
              {r.waitingReview && r.state !== "PENDING" ? <Body muted>A new one is waiting for Sentroh to check.</Body> : null}
              {r.rejectReason ? <Body style={{ marginTop: 4 }}>Reason: {r.rejectReason}</Body> : null}
              {canEdit && group !== r.group && !(r.state === "PENDING") ? (
                <Button title={r.state === "MISSING" ? "Upload" : "Upload a new one"} kind={r.state === "APPROVED" ? "secondary" : "primary"}
                  style={{ marginTop: 8 }} onPress={() => start(r.group)} />
              ) : null}
            </Card>
            {group === r.group ? form : null}
          </View>
        );
      })}

      {canEdit && group !== "OPTIONAL" ? <Button title="Upload another document (sanitary permit, etc.)" kind="secondary" onPress={() => start("OPTIONAL")} /> : null}
      {group === "OPTIONAL" ? form : null}

      {v.documents.length ? (
        <Card>
          <Label>Uploaded</Label>
          {v.documents.map((d) => (
            <View key={d.id} style={[s.row, { justifyContent: "space-between", paddingVertical: 4 }]}>
              <Text style={[s.body, { flex: 1, paddingRight: 8 }]} numberOfLines={1}>{d.label}</Text>
              <Pill text={d.status === "APPROVED" ? "Approved" : d.status === "PENDING" ? "Checking" : "Not accepted"}
                tone={d.status === "APPROVED" ? "done" : d.status === "PENDING" ? "active" : "stopped"} />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
