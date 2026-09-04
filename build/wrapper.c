/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

#include "hunspell.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

static int add_size(size_t* total, size_t extra) {
  if (extra > SIZE_MAX - *total) {
    return -1;
  }
  *total += extra;
  return 0;
}

static char* empty_string(void) {
  char* text = malloc(1);
  if (text == NULL) {
    return NULL;
  }
  text[0] = '\0';
  return text;
}

static void release_list(Hunhandle* handle, char** list, int count) {
  if (handle == NULL || list == NULL) {
    return;
  }
  Hunspell_free_list(handle, &list, count < 0 ? 0 : count);
}

static char* join_list(Hunhandle* handle, char** list, int count) {
  if (handle == NULL) {
    return empty_string();
  }

  if (count <= 0 || list == NULL) {
    release_list(handle, list, count);
    return empty_string();
  }

  size_t total = 0;
  for (int i = 0; i < count; i++) {
    size_t length = list[i] == NULL ? 0 : strlen(list[i]);
    if (add_size(&total, length) != 0) {
      release_list(handle, list, count);
      return NULL;
    }
    if (i + 1 < count && add_size(&total, 1) != 0) {
      release_list(handle, list, count);
      return NULL;
    }
  }

  if (total == SIZE_MAX) {
    release_list(handle, list, count);
    return NULL;
  }

  char* text = malloc(total + 1);
  if (text == NULL) {
    release_list(handle, list, count);
    return NULL;
  }

  char* cursor = text;
  for (int i = 0; i < count; i++) {
    if (list[i] != NULL) {
      size_t length = strlen(list[i]);
      memcpy(cursor, list[i], length);
      cursor += length;
    }
    if (i + 1 < count) {
      *cursor++ = '\n';
    }
  }
  *cursor = '\0';

  release_list(handle, list, count);
  return text;
}

void* hs_create(const char* affPath, const char* dicPath) {
  if (affPath == NULL || dicPath == NULL) {
    return NULL;
  }
  return Hunspell_create(affPath, dicPath);
}

void hs_destroy(void* handle) {
  if (handle == NULL) {
    return;
  }
  Hunspell_destroy(handle);
}

int hs_spell(void* handle, const char* word) {
  if (handle == NULL || word == NULL) {
    return 0;
  }
  return Hunspell_spell(handle, word) != 0 ? 1 : 0;
}

char* hs_analyze(void* handle, const char* word) {
  if (handle == NULL || word == NULL) {
    return empty_string();
  }
  char** list = NULL;
  int count = Hunspell_analyze(handle, &list, word);
  return join_list(handle, list, count);
}

char* hs_stem(void* handle, const char* word) {
  if (handle == NULL || word == NULL) {
    return empty_string();
  }
  char** list = NULL;
  int count = Hunspell_stem(handle, &list, word);
  return join_list(handle, list, count);
}

char* hs_suggest(void* handle, const char* word) {
  if (handle == NULL || word == NULL) {
    return empty_string();
  }
  char** list = NULL;
  int count = Hunspell_suggest(handle, &list, word);
  return join_list(handle, list, count);
}

char* hs_generate(void* handle, const char* word, const char* example) {
  if (handle == NULL || word == NULL || example == NULL) {
    return empty_string();
  }
  char** list = NULL;
  int count = Hunspell_generate(handle, &list, word, example);
  return join_list(handle, list, count);
}

void hs_free(char* text) {
  free(text);
}
