import mongoose, { Schema, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 64,
    },
    publicKeys: {
      type: [String],
      default: [],
    },
    deviceIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

export type User = InferSchemaType<typeof UserSchema>;

export const UserModel =
  (mongoose.models.User as mongoose.Model<User>) ||
  mongoose.model<User>("User", UserSchema);
