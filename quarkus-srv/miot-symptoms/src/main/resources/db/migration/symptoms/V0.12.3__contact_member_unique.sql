CREATE UNIQUE INDEX uq_contact_member ON miot_symptoms.contact (tenant_code, member_user_id)
    WHERE member_user_id IS NOT NULL;
