/**
 * FILE: supabase/functions/provision-student-accounts/index.ts
 *
 * Mục đích:
 * Cấp và reset tài khoản Auth cho học sinh đã tồn tại trong students.
 *
 * Quy tắc:
 * - Chỉ GVCN được phép gọi.
 * - Provision là idempotent: có user_id thì reset, không tạo học sinh mới.
 * - Mật khẩu tạm thời = Mã HS.
 * - force_password_change được đặt true sau provision/reset.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_DOMAIN = "student.so-chu-nhiem.local";

Deno.serve(async (req) => {
  try {
    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();

    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (callerProfile?.role !== "teacher") {
      return new Response(
        JSON.stringify({ error: "Chỉ GVCN được phép." }),
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const admin = createClient(url, serviceRoleKey);

    let query = admin
      .from("students")
      .select("id, full_name, student_code, user_id")
      .order("student_code");

    if (body.student_id) {
      query = query.eq("id", body.student_id);
    }

    const { data: students, error: studentsError } = await query;

    if (studentsError) {
      throw studentsError;
    }

    const results = [];

    for (const student of students ?? []) {
      const code = String(student.student_code || "").trim();

      if (!code) {
        results.push({
          id: student.id,
          status: "failed",
          error: "Học sinh thiếu Mã HS.",
        });
        continue;
      }

      const email = code.toLowerCase() + "@" + EMAIL_DOMAIN;

      try {
        let userId = student.user_id;

        if (userId) {
          const { data: existing } = await admin.auth.admin.getUserById(userId);

          if (!existing?.user) {
            userId = null;
          }
        }

        if (!userId) {
          const { data: created, error: createError } =
            await admin.auth.admin.createUser({
              email,
              password: code,
              email_confirm: true,
              user_metadata: {
                full_name: student.full_name,
                student_code: code,
                force_password_change: true,
              },
            });

          if (createError) {
            throw createError;
          }

          userId = created.user.id;

          const { error: linkError } = await admin
            .from("students")
            .update({ user_id: userId })
            .eq("id", student.id);

          if (linkError) {
            throw linkError;
          }
        } else {
          const { error: resetError } = await admin.auth.admin.updateUserById(
            userId,
            {
              password: code,
              user_metadata: {
                full_name: student.full_name,
                student_code: code,
                force_password_change: true,
              },
            },
          );

          if (resetError) {
            throw resetError;
          }
        }

        const { error: profileError } = await admin
          .from("profiles")
          .upsert({
            id: userId,
            full_name: student.full_name,
            role: "student",
          });

        if (profileError) {
          throw profileError;
        }

        results.push({
          id: student.id,
          student_code: code,
          status: "ready",
          action: student.user_id ? "reset" : "created",
        });
      } catch (error) {
        results.push({
          id: student.id,
          student_code: code,
          status: "failed",
          error: String(error?.message || error),
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total: results.length,
        ready: results.filter((item) => item.status === "ready").length,
        failed: results.filter((item) => item.status === "failed").length,
        results,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error?.message || error) }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});