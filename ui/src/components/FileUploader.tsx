import React, { useState } from "react";
import {
  Button,
  CircularProgress,
  Typography,
  Box,
  Alert,
} from "@mui/material";
import "../styles/FileUploader.css";

interface FileUploaderProps {
  onFileUpload: (file: File) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  isCompact?: boolean; // 是否使用紧凑模式 (当在主界面显示时)
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFileUpload,
  isLoading,
  error,
  isCompact = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (selectedFile) {
      await onFileUpload(selectedFile);
      setSelectedFile(null);
      // 重置input以便重新选择相同文件
      const fileInput = document.getElementById(
        "contract-file-input",
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    }
  };

  return (
    <Box className="file-uploader">
      <Typography variant="h6" component="h3" gutterBottom={!isCompact}>
        上传合同文档
      </Typography>

      <Box className="upload-container">
        <input
          accept=".doc,.docx"
          style={{ display: "none" }}
          id="contract-file-input"
          type="file"
          onChange={handleFileChange}
          disabled={isLoading}
        />

        <label htmlFor="contract-file-input">
          <Button
            variant="outlined"
            component="span"
            disabled={isLoading}
            size={isCompact ? "small" : "medium"}
          >
            选择文件
          </Button>
        </label>

        {selectedFile && (
          <Box className="selected-file">
            <Typography variant="body2" component="span">
              已选择: {selectedFile.name}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={handleUpload}
              disabled={isLoading}
              size={isCompact ? "small" : "medium"}
            >
              {isLoading ? (
                <CircularProgress size={isCompact ? 18 : 24} />
              ) : (
                "上传文件"
              )}
            </Button>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" className="upload-error">
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default FileUploader;
