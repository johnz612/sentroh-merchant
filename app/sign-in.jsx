import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Field, Notice, s } from "@/components/ui";
import { useSession } from "@/lib/session";
import { normalizePhone, supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";

export default function SignIn() {
  const load = useSession((st) => st.load);
  const [step, setStep] = useState("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const phone = normalizePhone(phoneInput);

  async function sendCode() {
    if (!phone) return setError(new Error("Enter your mobile number, like 0917 123 4567."));
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (err) return setError(new Error(err.message || "Could not send the code. Try again."));
    setStep("code");
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) return setError(new Error("Enter the 6-digit code from the SMS."));
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    if (err) { setBusy(false); return setError(new Error("That code is wrong or expired. Check the SMS or send a new code.")); }
    await load();
    setBusy(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.ink }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ padding: 24, paddingTop: 48 }}>
          <Text style={{ color: "#fff", fontSize: 40, fontWeight: "800", letterSpacing: -0.5 }}>Sentroh</Text>
          <Text style={{ color: "#C3CEE2", fontSize: 17, marginTop: 4 }}>For stores: receive orders, manage products and hours.</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: C.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
          {step === "phone" ? (
            <>
              <Text style={[s.title, { fontSize: 22, marginBottom: 12 }]}>Sign in</Text>
              <Field label="Mobile number" keyboardType="phone-pad" autoComplete="tel" placeholder="0917 123 4567"
                value={phoneInput} onChangeText={setPhoneInput} autoFocus />
              <Notice error={error} />
              <Button title="Send code" onPress={sendCode} busy={busy} />
              <Text style={[s.sub, { marginTop: 16 }]}>New to Sentroh? Sign in with your number, then register your store.</Text>
            </>
          ) : (
            <>
              <Text style={[s.title, { fontSize: 22 }]}>Enter the code</Text>
              <Text style={[s.sub, { marginBottom: 12 }]}>We sent a 6-digit code by SMS to {phone}.</Text>
              <Field label="Code" keyboardType="number-pad" autoComplete="sms-otp" maxLength={6}
                value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} autoFocus />
              <Notice error={error} />
              <Button title="Sign in" onPress={verify} busy={busy} />
              <Pressable onPress={() => { setStep("phone"); setCode(""); setError(null); }} style={{ marginTop: 16 }}>
                <Text style={[s.body, { color: C.teal, fontWeight: "600" }]}>Use a different number</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
