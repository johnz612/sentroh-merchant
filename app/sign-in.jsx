import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Field, Notice, s } from "@/components/ui";
import { useSession } from "@/lib/session";
import { normalizePhone, supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";

/**
 * Store sign-in: mobile number + password (like the customer app; same account).
 * The SMS code is only for the first time (no password yet) and for a forgotten
 * password: code, then a new password. The app stays signed in after that.
 */
export default function SignIn() {
  const load = useSession((st) => st.load);
  const [step, setStep] = useState("password"); // password | code
  const [phoneInput, setPhoneInput] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const phone = normalizePhone(phoneInput);
  const phoneError = new Error("Enter your mobile number, like 0917 123 4567.");

  async function signIn() {
    if (!phone) return setError(phoneError);
    if (!password) return setError(new Error("Enter your password."));
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ phone, password });
    if (err) {
      setBusy(false);
      return setError(new Error(/invalid login credentials/i.test(err.message || "")
        ? "Wrong mobile number or password. First time here or forgot it? Use \"Sign in with an SMS code\" below."
        : err.message || "Could not sign in. Try again."));
    }
    await load();
    setBusy(false);
  }

  async function sendCode() {
    if (!phone) return setError(phoneError);
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (err) return setError(new Error(err.message || "Could not send the code. Try again."));
    setStep("code");
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) return setError(new Error("Enter the 6-digit code from the SMS."));
    if (newPassword.length < 8) return setError(new Error("Choose a password with at least 8 characters."));
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    if (err) { setBusy(false); return setError(new Error("That code is wrong or expired. Check the SMS or send a new code.")); }
    // Signed in now. If saving the password fails, the store can still work; next time, use a code again.
    await supabase.auth.updateUser({ password: newPassword });
    await load();
    setBusy(false);
  }

  function back() {
    setStep("password"); setCode(""); setNewPassword(""); setError(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.ink }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ padding: 24, paddingTop: 48 }}>
          <Text style={{ color: "#fff", fontSize: 40, fontWeight: "800", letterSpacing: -0.5 }}>Sentroh</Text>
          <Text style={{ color: "#C3CEE2", fontSize: 17, marginTop: 4 }}>For stores: receive orders, manage products and hours.</Text>
        </View>
        <ScrollView style={{ flex: 1, backgroundColor: C.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
          contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
          {step === "password" ? (
            <>
              <Text style={[s.title, { fontSize: 22, marginBottom: 12 }]}>Sign in</Text>
              <Field label="Mobile number" keyboardType="phone-pad" autoComplete="tel" placeholder="0917 123 4567"
                value={phoneInput} onChangeText={setPhoneInput} />
              <Field label="Password" secureTextEntry autoComplete="current-password" autoCapitalize="none"
                value={password} onChangeText={setPassword} onSubmitEditing={signIn} returnKeyType="go" />
              <Notice error={error} />
              <Button title="Sign in" onPress={signIn} busy={busy} />
              <Pressable onPress={sendCode} disabled={busy} style={{ marginTop: 20 }} accessibilityRole="button">
                <Text style={[s.body, { color: C.teal, fontWeight: "600" }]}>Sign in with an SMS code</Text>
              </Pressable>
              <Text style={[s.sub, { marginTop: 4 }]}>
                First time here, or forgot your password? Enter your number above and we'll text you a code; then you choose a password.
              </Text>
              <Text style={[s.sub, { marginTop: 16 }]}>Already use the Sentroh app? Your number and password work here too.</Text>
            </>
          ) : (
            <>
              <Text style={[s.title, { fontSize: 22 }]}>Enter the code</Text>
              <Text style={[s.sub, { marginBottom: 12 }]}>We sent a 6-digit code by SMS to {phone}.</Text>
              <Field label="Code" keyboardType="number-pad" autoComplete="sms-otp" maxLength={6}
                value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} autoFocus />
              <Field label="New password" hint="At least 8 characters. Use it to sign in next time, no code needed."
                secureTextEntry autoComplete="new-password" autoCapitalize="none" value={newPassword} onChangeText={setNewPassword} />
              <Notice error={error} />
              <Button title="Sign in" onPress={verify} busy={busy} />
              <Pressable onPress={sendCode} disabled={busy} style={{ marginTop: 16 }}>
                <Text style={[s.body, { color: C.teal, fontWeight: "600" }]}>Send a new code</Text>
              </Pressable>
              <Pressable onPress={back} style={{ marginTop: 12 }}>
                <Text style={[s.body, { color: C.teal, fontWeight: "600" }]}>Back to sign in with password</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
